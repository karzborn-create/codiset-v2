# 🚀 Codiset 자동 업데이트 설정 가이드

> **딱 3가지만 하면 됩니다:** ① GitHub 만들기 → ② 토큰 발급 → ③ 명령어 한 줄 실행

---

## 📋 준비물

| 준비물 | 설명 | 소요시간 |
|--------|------|:------:|
| GitHub 계정 | 무료 회원가입 | 3분 |
| GitHub 토큰 | 클릭 몇 번이면 발급됨 | 2분 |
| 인터넷 연결 | 당연히 필요 | - |

---

## 1단계: GitHub 계정 만들기 (이미 있으면 건너뛰기)

1. **[github.com](https://github.com)** 접속
2. 오른쪽 위 **Sign up** 클릭
3. 이메일, 비밀번호, 사용자 이름 입력 후 가입
4. 이메일 인증 완료

> ⚠️ **사용자 이름(username)을 꼭 기억해두세요!** 나중에 설정 파일에 넣어야 합니다.

---

## 2단계: GitHub에 프로젝트 올리기

### 2-1. GitHub에서 새 저장소(Repository) 만들기

1. GitHub 로그인 후 오른쪽 위 **+** 버튼 → **New repository** 클릭
2. 아래 내용을 그대로 입력:

| 항목 | 입력값 |
|------|--------|
| Repository name | `codiset-v2` |
| Description | `에이블리 신상 셀렉 데스크톱 앱` |
| 공개 여부 | **Public** 선택 |

3. **Create repository** 버튼 클릭

### 2-2. 코드 업로드하기 (터미널에서 실행)

Visual Studio Code 터미널(`Ctrl + \``)을 열고 아래 명령어를 **한 줄씩** 복사해서 실행하세요.

```bash
# 1. Git 초기화 (이미 되어있다면 건너뛰세요)
git init

# 2. 모든 파일 추가
git add .

# 3. 첫 번째 커밋
git commit -m "첫 커밋: Codiset v1.0.0"

# 4. GitHub 연결 (아래 YOUR_USERNAME을 본인 GitHub 사용자 이름으로 바꾸세요!)
git remote add origin https://github.com/YOUR_USERNAME/codiset-v2.git

# 5. 업로드
git branch -M main
git push -u origin main
```

> 💡 **예시**: GitHub 사용자 이름이 `rlvk9`라면?
> ```
> git remote add origin https://github.com/rlvk9/codiset-v2.git
> ```

---

## 3단계: GitHub 토큰 발급

`electron-builder`가 GitHub에 파일을 올릴 때 필요한 비밀번호입니다.

1. GitHub 우측 상단 **프로필 아이콘** 클릭 → **Settings**
2. 왼쪽 메뉴 맨 아래 **Developer settings** 클릭
3. 왼쪽 **Personal access tokens** → **Tokens (classic)** 클릭
4. **Generate new token** → **Generate new token (classic)** 클릭
5. 아래와 같이 설정:

| 항목 | 입력값 |
|------|--------|
| Note | `codiset-builder` |
| Expiration | **No expiration** 선택 |

6. **Select scopes** 에서 **repo** 체크박스 클릭 (모든 하위 항목이 자동 체크됨)
7. 맨 아래 초록색 **Generate token** 버튼 클릭
8. 생성된 토큰을 **복사**하세요! (화면을 나가면 다시 못 봅니다)

> 🔑 생성된 토큰은 `ghp_`로 시작하는 긴 문자열입니다.

### 토큰을 컴퓨터에 등록하기

#### 방법 A: PowerShell에서 (추천)

```powershell
[Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_복사한토큰을여기붙여넣기", "User")
```

#### 방법 B: 명령 프롬프트(cmd)에서

```cmd
setx GH_TOKEN "ghp_복사한토큰을여기붙여넣기"
```

> ⚠️ 위 명령어 실행 후, **터미널을 껐다가 다시 열어야** 적용됩니다.

---

## 4단계: package.json에서 GitHub 사용자 이름 수정

[`package.json`](package.json) 파일을 열고, 아래 부분을 찾아 `YOUR_GITHUB_USERNAME`을 **본인 GitHub 사용자 이름**으로 바꾸세요.

```jsonc
"publish": {
    "provider": "github",
    "owner": "YOUR_GITHUB_USERNAME",   // ← 여기를 본인 ID로 변경!
    "repo": "codiset-v2"
}
```

> 💡 **예시**: 사용자 이름이 `rlvk9`라면 `"owner": "rlvk9"` 로 변경

---

## 5단계: 첫 번째 릴리즈 만들기

터미널에서 딱 한 줄만 실행하면 됩니다.

```bash
npm run publish
```

이 명령어가 하는 일:
1. 앱을 설치 파일(`.exe`)로 만듦
2. GitHub Releases 페이지에 자동 업로드
3. 사용자들이 새 버전을 받을 수 있게 준비 완료!

> ⏱️ 처음 실행 시 3~5분 정도 걸릴 수 있습니다.

---

## 6단계: 잘 되었는지 확인하기

1. GitHub에서 본인 저장소(`github.com/YOUR_USERNAME/codiset-v2`) 접속
2. 오른쪽 **Releases** 탭 클릭
3. `v1.0.0` 릴리즈가 보이고, `Codiset-Setup-1.0.0.exe` 파일이 보이면 성공!

---

## 🔄 다음 업데이트 배포하는 법 (v1.0.0 → v1.0.1)

1. 코드 수정 후, 버전 번호 올리기:

```bash
npm version patch
```

2. 변경사항 GitHub에 올리기:

```bash
git push origin main --tags
```

3. 새 버전 릴리즈 생성:

```bash
npm run publish
```

> 끝! 사용자들은 다음에 앱을 켤 때 자동으로 업데이트 알림을 받습니다.

---

## ❓ 문제 해결

| 문제 | 해결 방법 |
|------|-----------|
| `GH_TOKEN` 없다고 뜸 | 3단계 다시 확인. 터미널을 껐다 켜보세요. |
| `npm run publish` 실패 | `npm install` 한 번 더 실행 후 다시 시도 |
| 업로드 권한 오류 | GitHub 토큰에 `repo` 권한이 체크되어 있는지 확인 |
| 사용자한테 업데이트 알림 안 뜸 | `package.json`의 `version`이 실제로 올라갔는지 확인 |

---

## 📦 설치 파일을 사용자에게 전달하려면?

`npm run publish`를 실행하고 나면 GitHub Releases 페이지에서 `.exe` 파일을 다운로드할 수 있습니다.

사용자는 이 파일을 다운로드해서 설치하면 되고, 그 이후부터는 **앱을 켤 때마다 자동으로 새 버전을 확인**합니다.

---

> 🎉 **끝!** 이제 Codiset 앱은 자동 업데이트를 지원합니다.
