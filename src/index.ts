/**
 * Dev Debug Helper
 *
 * React 개발 시 요소의 className과 파일 경로를 쉽게 복사할 수 있는 디버그 도구
 *
 * 기능:
 * - Ctrl + 마우스 이동: className 및 파일 경로 미리보기
 * - Ctrl + 우클릭: 클립보드에 복사
 *
 * 설치:
 * 1. 이 폴더를 프로젝트에 복사하거나 npm 패키지로 설치
 * 2. React 앱의 index.tsx에서 import 후 initDevDebugHelper() 호출
 *
 * 사용법:
 * import { initDevDebugHelper } from 'dev-debug-helper';
 * initDevDebugHelper();
 */

export interface DevDebugConfig {
  /** 활성화 여부 저장 키 */
  storageKey?: string;
  /** 개발 환경에서만 실행 여부 */
  devOnly?: boolean;
  /** 허용할 호스트 목록 (devOnly가 true일 때) */
  allowedHosts?: string[];
  /** 복사 포맷 커스터마이징 */
  formatCopyText?: (info: ElementInfo) => string;
  /** 툴팁 포맷 커스터마이징 */
  formatTooltip?: (info: ElementInfo) => string;
  /** 테마 색상 */
  theme?: {
    primary?: string;
    background?: string;
    text?: string;
    border?: string;
  };
}

export interface ElementInfo {
  className: string;
  filePath: string | null;
  lineNumber: string | null;
  componentName: string | null;
  tagName: string;
}

// 기본 설정
const DEFAULT_CONFIG: Required<DevDebugConfig> = {
  storageKey: 'devDebugEnabled',
  devOnly: true,
  allowedHosts: ['localhost', '127.0.0.1'],
  formatCopyText: (info) => {
    let result = '';
    if (info.filePath) {
      result += `// ${info.filePath}`;
      if (info.lineNumber) {
        result += `:${info.lineNumber}`;
      }
      result += '\n';
    }
    if (info.componentName) {
      result += `// Component: ${info.componentName}\n`;
    }
    result += `className="${info.className}"`;
    return result;
  },
  formatTooltip: (info) => {
    let result = '';
    if (info.filePath) {
      result += `📁 ${info.filePath}`;
      if (info.lineNumber) {
        result += `:${info.lineNumber}`;
      }
      result += '\n';
    }
    if (info.componentName) {
      result += `⚛️ ${info.componentName}\n`;
    }
    result += `🏷️ ${info.className.length > 60 ? info.className.substring(0, 60) + '...' : info.className}`;
    return result;
  },
  theme: {
    primary: '#00ff88',
    background: '#1a1a2e',
    text: '#00ff88',
    border: '#00ff88',
  },
};

// 상태 관리
let isInitialized = false;
let isActive = false;
let config: Required<DevDebugConfig> = DEFAULT_CONFIG;
let tooltip: HTMLDivElement | null = null;

// 이벤트 핸들러 참조
let contextMenuHandler: ((e: MouseEvent) => void) | null = null;
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
let keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
let keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * React Fiber에서 소스 파일 정보 추출
 */
function getReactSourceInfo(element: HTMLElement): Partial<ElementInfo> {
  const result: Partial<ElementInfo> = {
    filePath: null,
    lineNumber: null,
    componentName: null,
  };

  try {
    // React Fiber 노드 찾기
    const fiberKey = Object.keys(element).find(
      key => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
    );

    if (!fiberKey) return result;

    let fiber = (element as any)[fiberKey];

    // Fiber 트리를 올라가며 _debugSource 찾기
    let maxDepth = 20; // 무한 루프 방지
    while (fiber && maxDepth > 0) {
      // _debugSource에서 파일 정보 추출
      if (fiber._debugSource) {
        const source = fiber._debugSource;
        if (source.fileName) {
          // 프로젝트 루트 기준 상대 경로로 변환
          let filePath = source.fileName;

          // webpack:// 또는 절대 경로에서 src/ 이후 부분만 추출
          const srcIndex = filePath.indexOf('/src/');
          if (srcIndex !== -1) {
            filePath = filePath.substring(srcIndex + 1); // 'src/...' 형태로
          } else {
            // src가 없으면 파일명만
            const lastSlash = filePath.lastIndexOf('/');
            if (lastSlash !== -1) {
              filePath = filePath.substring(lastSlash + 1);
            }
          }

          result.filePath = filePath;
          result.lineNumber = source.lineNumber?.toString() || null;
        }
      }

      // 컴포넌트 이름 추출
      if (fiber.type) {
        const typeName = fiber.type.displayName || fiber.type.name;
        if (typeName && !result.componentName) {
          // 내장 HTML 태그가 아닌 경우에만
          if (typeof fiber.type !== 'string') {
            result.componentName = typeName;
          }
        }
      }

      // 정보를 찾았으면 중단
      if (result.filePath && result.componentName) {
        break;
      }

      fiber = fiber.return;
      maxDepth--;
    }
  } catch (e) {
    // React 내부 구조 접근 실패 시 무시
    console.debug('[DevDebug] Failed to extract React source info:', e);
  }

  return result;
}

/**
 * 요소 정보 수집
 */
function getElementInfo(element: HTMLElement): ElementInfo | null {
  const className = element.className;

  if (!className || typeof className !== 'string') {
    return null;
  }

  const reactInfo = getReactSourceInfo(element);

  return {
    className,
    tagName: element.tagName.toLowerCase(),
    filePath: reactInfo.filePath || null,
    lineNumber: reactInfo.lineNumber || null,
    componentName: reactInfo.componentName || null,
  };
}

/**
 * 툴팁 생성
 */
function createTooltip(): HTMLDivElement {
  if (tooltip) return tooltip;

  tooltip = document.createElement('div');
  tooltip.id = 'dev-debug-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    background: ${config.theme.background};
    color: ${config.theme.text};
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    z-index: 99999;
    pointer-events: none;
    max-width: 500px;
    white-space: pre-wrap;
    word-break: break-all;
    border: 1px solid ${config.theme.border};
    box-shadow: 0 4px 16px rgba(0, 255, 136, 0.15);
    display: none;
    line-height: 1.5;
  `;
  document.body.appendChild(tooltip);
  return tooltip;
}

/**
 * 툴팁 표시
 */
function showTooltip(e: MouseEvent, text: string) {
  const tip = createTooltip();
  tip.textContent = text;
  tip.style.display = 'block';
  tip.style.left = `${e.clientX + 15}px`;
  tip.style.top = `${e.clientY + 15}px`;

  // 화면 밖으로 나가지 않도록 조정
  requestAnimationFrame(() => {
    const rect = tip.getBoundingClientRect();
    if (rect.right > window.innerWidth - 10) {
      tip.style.left = `${e.clientX - rect.width - 15}px`;
    }
    if (rect.bottom > window.innerHeight - 10) {
      tip.style.top = `${e.clientY - rect.height - 15}px`;
    }
  });
}

/**
 * 툴팁 숨기기
 */
function hideTooltip() {
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

/**
 * 복사 알림 표시
 */
function showCopyNotification(text: string) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${config.theme.primary};
    color: ${config.theme.background};
    padding: 14px 20px;
    border-radius: 10px;
    font-size: 13px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    z-index: 99999;
    max-width: 600px;
    white-space: pre-wrap;
    word-break: break-all;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  const lines = text.split('\n');
  const preview = lines.length > 3
    ? lines.slice(0, 3).join('\n') + '\n...'
    : text;
  const displayText = preview.length > 150 ? preview.substring(0, 150) + '...' : preview;

  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 6px; font-size: 14px;">✓ 클립보드에 복사됨</div>
    <div style="opacity: 0.85; font-size: 11px;">${displayText.replace(/\n/g, '<br>')}</div>
  `;

  document.body.appendChild(notification);

  // 애니메이션 후 제거
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(10px)';
    notification.style.transition = 'all 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2500);
}

/**
 * 이벤트 리스너 등록
 */
function attachEventListeners() {
  let ctrlPressed = false;

  keyDownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Control') {
      ctrlPressed = true;
    }
  };

  keyUpHandler = (e: KeyboardEvent) => {
    if (e.key === 'Control') {
      ctrlPressed = false;
      hideTooltip();
    }
  };

  mouseMoveHandler = (e: MouseEvent) => {
    if (!isActive || !ctrlPressed) {
      hideTooltip();
      return;
    }

    const target = e.target as HTMLElement;
    if (!target) {
      hideTooltip();
      return;
    }

    const info = getElementInfo(target);
    if (!info) {
      hideTooltip();
      return;
    }

    const tooltipText = config.formatTooltip(info);
    showTooltip(e, `[Ctrl+우클릭: 복사]\n${tooltipText}`);
  };

  contextMenuHandler = (e: MouseEvent) => {
    if (!isActive || !ctrlPressed) return;

    const target = e.target as HTMLElement;
    if (!target) return;

    const info = getElementInfo(target);
    if (!info) return;

    e.preventDefault();

    const copyText = config.formatCopyText(info);

    navigator.clipboard.writeText(copyText).then(() => {
      showCopyNotification(copyText);
    }).catch(err => {
      console.error('[DevDebug] 복사 실패:', err);
    });
  };

  document.addEventListener('keydown', keyDownHandler);
  document.addEventListener('keyup', keyUpHandler);
  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('contextmenu', contextMenuHandler);
}

/**
 * 이벤트 리스너 해제
 */
function detachEventListeners() {
  if (keyDownHandler) document.removeEventListener('keydown', keyDownHandler);
  if (keyUpHandler) document.removeEventListener('keyup', keyUpHandler);
  if (mouseMoveHandler) document.removeEventListener('mousemove', mouseMoveHandler);
  if (contextMenuHandler) document.removeEventListener('contextmenu', contextMenuHandler);

  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
}

/**
 * 디버그 모드 활성화 여부 확인
 */
export function isDebugEnabled(): boolean {
  return localStorage.getItem(config.storageKey) === 'true';
}

/**
 * 디버그 모드 토글
 */
export function setDebugEnabled(enabled: boolean): void {
  localStorage.setItem(config.storageKey, enabled.toString());
  isActive = enabled;

  if (enabled) {
    console.log(
      '%c[DevDebug] 디버그 모드 활성화됨\n' +
      '%c• Ctrl + 마우스 이동: 요소 정보 미리보기\n' +
      '• Ctrl + 우클릭: 클립보드에 복사\n' +
      '• 복사 형식: 파일경로 + className',
      'color: #00ff88; font-weight: bold; font-size: 14px;',
      'color: #888; font-size: 12px;'
    );
  } else {
    hideTooltip();
    console.log('%c[DevDebug] 디버그 모드 비활성화됨', 'color: #ff6b6b;');
  }
}

/**
 * 디버그 모드 토글 (현재 상태 반전)
 */
export function toggleDebugMode(): boolean {
  const newState = !isDebugEnabled();
  setDebugEnabled(newState);
  return newState;
}

/**
 * 초기화 (앱 시작 시 한 번만 호출)
 */
export function initDevDebugHelper(userConfig: DevDebugConfig = {}): void {
  if (isInitialized) {
    console.warn('[DevDebug] 이미 초기화되었습니다.');
    return;
  }

  // 설정 병합
  config = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...userConfig.theme,
    },
  };

  // 개발 환경 체크
  if (config.devOnly) {
    const isDev = config.allowedHosts.includes(window.location.hostname);
    if (!isDev) {
      console.log('[DevDebug] 프로덕션 환경에서는 비활성화됨');
      return;
    }
  }

  isInitialized = true;
  isActive = isDebugEnabled();

  // 이벤트 리스너 등록
  attachEventListeners();

  if (isActive) {
    console.log(
      '%c[DevDebug] 디버그 헬퍼 활성화됨\n' +
      '%c• Ctrl + 마우스 이동: 요소 정보 미리보기\n' +
      '• Ctrl + 우클릭: 클립보드에 복사',
      'color: #00ff88; font-weight: bold; font-size: 14px;',
      'color: #888; font-size: 12px;'
    );
  } else {
    console.log(
      '%c[DevDebug] 디버그 헬퍼 대기 중\n' +
      '%c시스템 설정에서 활성화하거나 콘솔에서 toggleDevDebug() 실행',
      'color: #888; font-size: 12px;',
      'color: #666; font-size: 11px;'
    );
  }

  // 글로벌 함수로 노출 (콘솔에서 쉽게 사용)
  (window as any).toggleDevDebug = toggleDebugMode;
  (window as any).enableDevDebug = () => setDebugEnabled(true);
  (window as any).disableDevDebug = () => setDebugEnabled(false);
}

/**
 * 완전히 제거
 */
export function destroyDevDebugHelper(): void {
  if (!isInitialized) return;

  detachEventListeners();
  isInitialized = false;
  isActive = false;

  delete (window as any).toggleDevDebug;
  delete (window as any).enableDevDebug;
  delete (window as any).disableDevDebug;

  console.log('[DevDebug] 디버그 헬퍼 제거됨');
}

// 기본 내보내기
export default {
  init: initDevDebugHelper,
  destroy: destroyDevDebugHelper,
  enable: () => setDebugEnabled(true),
  disable: () => setDebugEnabled(false),
  toggle: toggleDebugMode,
  isEnabled: isDebugEnabled,
};
