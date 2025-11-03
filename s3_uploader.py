"""import boto3
import os
import sys
from datetime import datetime

AWS_REGION = "us-east-1"
BUCKET_NAME = "image-posts-store"

s3 = boto3.client("s3", region_name=AWS_REGION)

def upload_image(local_path, is_safe):
    prefix = "safe" if is_safe else "unsafe"

    filename = os.path.basename(local_path)
    timestamp = datetime.now().strftime("%Y%m%d-%H-%M-%S")

    s3_key = f"{prefix}/{timestamp}-{filename}"

    s3.upload_file(local_path, BUCKET_NAME, s3_key)

    return {
        "success": True,
        "key": s3_key,
        "url": f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print({"success": False, "error": "Usage: python s3_uploader.py <file> <safe|unsafe>"})
        sys.exit(1)

    local_path = sys.argv[1]
    flag = sys.argv[2].lower() == "safe"

    result = upload_image(local_path, flag)
    print(result)  """
print("skipping for now -- ")