export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="text-xl text-gray-600 mt-4">페이지를 찾을 수 없습니다</p>
        <p className="text-sm text-gray-500 mt-2">
          현재 시간: {new Date().toLocaleString('ko-KR')}
        </p>
        <a 
          href="/" 
          className="mt-6 inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
        >
          홈으로 돌아가기
        </a>
      </div>
    </div>
  );
}
