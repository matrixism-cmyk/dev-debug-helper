# Dev Debug Helper

React 개발 시 요소의 **className**과 **파일 경로**를 쉽게 복사할 수 있는 디버그 도구입니다.

## 기능

- **Ctrl + 마우스 이동**: 요소의 className, 파일 경로, 컴포넌트명 미리보기
- **Ctrl + 우클릭**: 정보를 클립보드에 복사
- 개발 환경(localhost)에서만 동작
- 커스터마이징 가능한 복사 포맷과 테마

## 복사 결과 예시

```
// src/pages/UcellSelect/CellSelectionScreen.tsx:264
// Component: CellSelectionScreen
className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
```

## 설치 방법

### 방법 1: 폴더 복사 (권장)

1. `dev-debug-helper` 폴더를 프로젝트에 복사
2. 프로젝트의 `index.tsx`에서 import:

```typescript
// src/index.tsx
import { initDevDebugHelper } from './dev-debug-helper/src';

initDevDebugHelper();
```

### 방법 2: npm 로컬 설치

```bash
# dev-debug-helper 폴더에서
npm install
npm run build

# 프로젝트에서
npm install ../dev-debug-helper
```

### 방법 3: npm 패키지 배포 후 설치

```bash
# dev-debug-helper 폴더에서
npm publish

# 프로젝트에서
npm install dev-debug-helper
```

## 사용 방법

### 기본 사용

```typescript
import { initDevDebugHelper } from 'dev-debug-helper';

// 앱 시작 시 한 번만 호출
initDevDebugHelper();
```

### 커스텀 설정

```typescript
import { initDevDebugHelper } from 'dev-debug-helper';

initDevDebugHelper({
  // 로컬 스토리지 키
  storageKey: 'myAppDebugEnabled',

  // 개발 환경에서만 실행 (기본값: true)
  devOnly: true,

  // 허용할 호스트 목록
  allowedHosts: ['localhost', '127.0.0.1', 'dev.example.com'],

  // 복사 텍스트 포맷 커스터마이징
  formatCopyText: (info) => {
    return `File: ${info.filePath}\nClass: ${info.className}`;
  },

  // 툴팁 포맷 커스터마이징
  formatTooltip: (info) => {
    return `📁 ${info.filePath}\n🏷️ ${info.className}`;
  },

  // 테마 색상
  theme: {
    primary: '#00ff88',
    background: '#1a1a2e',
    text: '#00ff88',
    border: '#00ff88',
  },
});
```

## 콘솔 명령어

브라우저 개발자 도구 콘솔에서 직접 제어할 수 있습니다:

```javascript
// 디버그 모드 토글
toggleDevDebug()

// 활성화
enableDevDebug()

// 비활성화
disableDevDebug()
```

## API

### 함수

| 함수 | 설명 |
|------|------|
| `initDevDebugHelper(config?)` | 초기화 (앱 시작 시 한 번만 호출) |
| `destroyDevDebugHelper()` | 완전히 제거 |
| `setDebugEnabled(enabled)` | 활성화/비활성화 설정 |
| `isDebugEnabled()` | 현재 활성화 상태 확인 |
| `toggleDebugMode()` | 토글 |

### ElementInfo 타입

```typescript
interface ElementInfo {
  className: string;        // 요소의 className
  filePath: string | null;  // 소스 파일 경로 (예: src/pages/Home.tsx)
  lineNumber: string | null; // 라인 번호
  componentName: string | null; // React 컴포넌트 이름
  tagName: string;          // HTML 태그 이름
}
```

## 주의사항

- **React 개발 모드에서만 동작**: 프로덕션 빌드에서는 `_debugSource` 정보가 제거되어 파일 경로를 가져올 수 없습니다.
- **localhost에서만 동작**: 기본적으로 localhost와 127.0.0.1에서만 활성화됩니다.
- **성능 영향 없음**: 개발 환경에서만 동작하며, 프로덕션에서는 자동으로 비활성화됩니다.

## 라이선스

MIT
