export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-warning/20 bg-warning-soft px-3 py-2.5 text-xs leading-5 text-warning">
      {message}
    </p>
  );
}
