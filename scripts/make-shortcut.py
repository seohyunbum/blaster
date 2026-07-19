# 바탕화면 바로가기 생성 (재현용) — 배포된 GitHub Pages 를 기본 브라우저로 여는 인터넷 바로가기(.url).
# 이 PC 는 PowerShell/WScript.Shell 정책 차단이라 순수 파이썬으로 .url 을 직접 쓴다(외부 의존 없음).
# 로컬 개발 실행이 필요하면 launch-game.bat (npm run dev) 를 직접 실행하면 된다.
# 사용: python scripts/make-shortcut.py
import os

URL = "https://seohyunbum.github.io/blaster/"
ICON = r"C:\blaster-lab\assets\blaster.ico"
DEST = os.path.join(os.path.expanduser("~"), "Desktop", "블래스터 공방.url")

# INI 형식 인터넷 바로가기. newline="" 로 CRLF 를 정확히 유지(텍스트모드 \r\r\n 중복 방지).
content = (
    "[InternetShortcut]\r\n"
    f"URL={URL}\r\n"
    f"IconFile={ICON}\r\n"
    "IconIndex=0\r\n"
)
with open(DEST, "w", encoding="utf-8", newline="") as f:
    f.write(content)
print("desktop URL shortcut written:", DEST)
