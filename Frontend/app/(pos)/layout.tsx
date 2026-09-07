export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-neutro-900 select-none">
      {children}
    </div>
  );
}
