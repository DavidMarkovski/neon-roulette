import CrashGame from './CrashGame';

export default async function CrashPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrashGame tableId={id} />;
}
