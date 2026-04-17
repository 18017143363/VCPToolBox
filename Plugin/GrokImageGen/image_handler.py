import sys
import json
import os
import requests
import base64
import uuid
import re
from io import BytesIO
from PIL import Image
from dotenv import load_dotenv
from datetime import datetime
import traceback
from urllib.parse import urlparse
from urllib.request import url2pathname

class LocalFileNotFoundError(Exception):
    def __init__(self, message, file_url):
        super().__init__(message)
        self.file_url = file_url

LOG_FILE = "GrokImageHistory.log"

def log_event(level, message, data=None):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    log_entry = f"[{timestamp}] [{level.upper()}] {message}"
    if data:
        try:
            log_entry += f" | Data: {json.dumps(data, ensure_ascii=False)}"
        except Exception:
            log_entry += f" | Data: [Unserializable]"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_entry + "\n")
    except Exception:
        pass

def print_json_output(status, result=None, error=None, ai_message=None):
    output = {"status": status}
    if status == "success":
        if result is not None:
            output["result"] = result
        if ai_message:
            output["messageForAI"] = ai_message
    elif status == "error":
        if error is not None:
            output["error"] = error
    print(json.dumps(output, ensure_ascii=False))
    log_event("debug", "Output sent to stdout", output)

def image_to_base64(img):
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=90)
    img_bytes = buffer.getvalue()
    base64_encoded = base64.b64encode(img_bytes).decode('utf-8')
    return f"data:image/jpeg;base64,{base64_encoded}"

def process_image_from_url(image_url):
    try:
        parsed_url = urlparse(image_url)
        img = None
        if parsed_url.scheme == 'file':
            file_path = url2pathname(parsed_url.path)
            if os.name == 'nt' and parsed_url.path.startswith('/'):
                file_path = url2pathname(parsed_url.path[1:])
            try:
                with open(file_path, 'rb') as f:
                    img = Image.open(f)
                    img.load()
            except FileNotFoundError:
                raise LocalFileNotFoundError("本地文件未找到", image_url)
        elif parsed_url.scheme in ['http', 'https']:
            response = requests.get(image_url, stream=True, timeout=30)
            response.raise_for_status()
            img = Image.open(response.raw)
        else:
            raise ValueError(f"不支持的URL协议: {parsed_url.scheme}")
        if img is None:
            raise ValueError("未能加载图片。")
        img = img.convert("RGB")
        return image_to_base64(img)
    except Exception as e:
        if isinstance(e, LocalFileNotFoundError):
            raise
        raise ValueError(f"图片处理失败: {e}")

def clean_url(url):
    """清理URL末尾的特殊字符"""
    if url:
        # 移除末尾的括号、引号等特殊字符
        # 移除末尾的特殊字符
        for char in [')', ']', '"', "'", '>', ' ']:
            url = url.rstrip(char)
        # 修复双斜杠问题
        url = url.replace('//images', '/images')
    return url

def download_image_sync(url, task_id, save_dir):
    try:
        os.makedirs(save_dir, exist_ok=True)
        ext = "jpg"
        path_part = url.split('?')[0]
        if '.' in path_part:
            potential_ext = path_part.split('.')[-1].lower()
            if potential_ext in ['png', 'jpg', 'jpeg', 'webp', 'gif']:
                ext = potential_ext
        filename = f"grok_{task_id}.{ext}"
        filepath = os.path.join(save_dir, filename)
        
        log_event("info", f"Downloading image: {url} -> {filepath}")
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        return filename
    except Exception as e:
        log_event("error", f"Failed to download image: {e}")
        return None

def main():
    dotenv_path = os.path.join(os.path.dirname(__file__), 'config.env')
    load_dotenv(dotenv_path=dotenv_path)
    
    api_key = os.getenv("GROK_API_KEY")
    api_base = os.getenv("GROK_API_BASE", "http://127.0.0.1:8000")
    model = os.getenv("GrokImageModelName", "grok-2-image-1212")
    
    project_base_path = os.getenv("PROJECT_BASE_PATH")
    server_port = os.getenv("SERVER_PORT")
    imageserver_image_key = os.getenv("IMAGESERVER_IMAGE_KEY")
    var_http_url = os.getenv("VarHttpUrl")

    if not api_key:
        print_json_output("error", error="GROK_API_KEY not found in config.env.")
        sys.exit(1)

    try:
        input_str = sys.stdin.read()
        if not input_str:
            sys.exit(0)
        input_data = json.loads(input_str)
    except Exception as e:
        print_json_output("error", error=f"Invalid JSON input: {e}")
        sys.exit(1)

    image_url = input_data.get("image_url")
    prompt = input_data.get("prompt")
    task_id = str(uuid.uuid4())[:8]

    try:
        if not prompt:
            raise ValueError("Missing prompt")
        
        image_base64 = None
        if image_url and isinstance(image_url, str) and image_url.strip():
            image_base64 = process_image_from_url(image_url)

        base_url = api_base.rstrip('/')
        if not base_url.endswith('/v1'):
            if not base_url.endswith('/v1/chat/completions'):
                api_url = f"{base_url}/v1/chat/completions"
            else:
                api_url = base_url
        else:
            api_url = f"{base_url}/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        content_list = [{"type": "text", "text": prompt}]
        if image_base64:
            content_list.append({"type": "image_url", "image_url": {"url": image_base64}})

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": content_list}],
            "stream": False
        }

        log_event("info", f"[{task_id}] Calling Grok API", {"url": api_url, "model": model})
        response = requests.post(api_url, json=payload, headers=headers, timeout=180)
        response.raise_for_status()
        result = response.json()

        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        image_result_url = None
        
        # 更宽松的URL匹配，支持各种图片格式
        url_match = re.search(r'(https?://[^\s<>"\')\]]+\.(?:png|jpg|jpeg|webp|gif))', content, re.IGNORECASE)
        if url_match:
            image_result_url = clean_url(url_match.group(1))
        
        # 备选：匹配markdown图片格式 ![](url)
        if not image_result_url:
            md_match = re.search(r'!\[.*?\]\((https?://[^)]+)\)', content)
            if md_match:
                image_result_url = clean_url(md_match.group(1))
        
        # 备选：匹配任意http URL
        if not image_result_url:
            any_url_match = re.search(r'(https?://[^\s<>"\')\]]+)', content)
            if any_url_match:
                url_candidate = any_url_match.group(1)
                if any(ext in url_candidate.lower() for ext in ['image', 'img', 'photo', 'pic']):
                    image_result_url = clean_url(url_candidate)

        if image_result_url:
            log_event("success", f"[{task_id}] Image URL obtained: {image_result_url}")
            
            local_filename = None
            accessible_url = image_result_url
            
            # 尝试下载到本地
            if project_base_path and server_port and imageserver_image_key and var_http_url:
                image_save_dir = os.path.join(project_base_path, 'image', 'grokimage')
                local_filename = download_image_sync(image_result_url, task_id, image_save_dir)
                
                if local_filename:
                    accessible_url = f"{var_http_url}:{server_port}/pw={imageserver_image_key}/images/grokimage/{local_filename}"
                    log_event("info", f"[{task_id}] Local accessible URL: {accessible_url}")

            ai_msg = f"Grok 图片生成成功！\n图片URL: {accessible_url}"
            if accessible_url != image_result_url:
                ai_msg += f"\n原始URL: {image_result_url}"

            print_json_output("success", result={
                "image_url": accessible_url,
                "original_url": image_result_url,
                "local_path": f"image/grokimage/{local_filename}" if local_filename else None,
                "requestId": task_id
            }, ai_message=ai_msg)
        else:
            log_event("error", f"[{task_id}] No image URL found in response", {"content": content[:500]})
            raise ValueError(f"未能从响应中提取图片URL。内容: {content[:300]}")

    except LocalFileNotFoundError as e:
        error_payload = {
            "status": "error",
            "code": "FILE_NOT_FOUND_LOCALLY",
            "error": str(e),
            "fileUrl": e.file_url
        }
        print(json.dumps(error_payload, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        log_event("error", f"[{task_id}] Failed", {"error": str(e), "traceback": traceback.format_exc()})
        print_json_output("error", error=str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()