/** 로그인·OAuth 콜백 등 전체 화면 로딩 표시 (배경·스피너 동일). */
export function AuthFlowSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-bubble-gray/80 via-white to-white px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
    </div>
  );
}
