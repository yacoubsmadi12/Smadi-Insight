import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FileUploader from "@/components/FileUploader";

export default function LogsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Upload Logs</h2>
            <p className="text-sm text-muted-foreground">
              Upload CSV or JSON log files for AI-powered analysis
            </p>
          </div>

          <FileUploader />
        </div>
      </div>
    </div>
  );
}
