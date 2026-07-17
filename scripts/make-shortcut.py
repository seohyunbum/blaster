# 바탕화면 바로가기 생성 (재현용) — 이 PC 는 WSH(WScript.Shell) 쓰기가 정책 차단이라 pylnk3 사용
# 사용: pip install pylnk3 && python scripts/make-shortcut.py
import pylnk3

pylnk3.for_file(
    r'C:\blaster-lab\launch-game.bat',
    lnk_name=r'C:\Users\서현범\Desktop\블래스터 공방.lnk',
    description='블래스터 공방 — 나만의 블래스터 만들기',
    icon_file=r'C:\blaster-lab\assets\blaster.ico',
    icon_index=0,
    work_dir=r'C:\blaster-lab',
)
print('desktop shortcut written')
