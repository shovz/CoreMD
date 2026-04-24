import AssistantChat from "../components/AssistantChat";

export default function ChatPage() {
  return (
    <section className="mx-auto h-[calc(100vh-7.5rem)] max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <AssistantChat />
    </section>
  );
}
