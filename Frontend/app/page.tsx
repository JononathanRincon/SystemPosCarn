import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutro-50 p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto w-20 h-20 bg-carmin-500 rounded-2xl flex items-center justify-center">
          <span className="text-white text-pos-xl font-bold">🥩</span>
        </div>

        <h1 className="text-pos-xl font-bold text-neutro-900">
          POS Carnicería
        </h1>
        <p className="text-neutro-500 text-pos-base">
          Sistema de Punto de Venta Multi-Sucursal
        </p>

        <div className="flex flex-col gap-4 pt-4">
          <Link
            href="/dashboard"
            className="btn-pos-primary w-full text-center"
          >
            Panel de Administración
          </Link>

          <Link
            href="/login-pin"
            className="btn-pos-secondary w-full text-center"
          >
            Acceso POS Mostrador
          </Link>
        </div>
      </div>
    </main>
  );
}
