// The title + one-line subtitle every auth card opens with. Extracted for the
// same reason as the form messages: five copies of the same two class strings
// means a typography change is a grep, and one missed page renders a different
// heading inside the same flow.
export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <>
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">{subtitle}</p>
    </>
  );
}
