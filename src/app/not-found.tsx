import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold uppercase">Không tìm thấy trang</h1>
      <Link href="/" className="mt-4 inline-block text-brand hover:underline">
        Về trang chủ
      </Link>
    </div>
  );
}
