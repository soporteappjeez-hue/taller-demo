import QuestionAlertGlobal from "@/components/QuestionAlertGlobal";

export default function AppjeezLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <QuestionAlertGlobal />
    </>
  );
}
