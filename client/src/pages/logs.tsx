import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FileUploader from "@/components/FileUploader";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LogsPage() {
  const { language } = useLanguage();
  
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {language === "ar" ? "رفع السجلات" : "Upload Logs"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {language === "ar" 
                ? "رفع ملفات CSV أو JSON للتحليل بالذكاء الاصطناعي" 
                : "Upload CSV or JSON log files for AI-powered analysis"}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {language === "ar" ? "الصيغ المدعومة" : "Supported Formats"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">
                  {language === "ar" ? "الصيغة الأولى (Operation Logs):" : "Format 1 (Operation Logs):"}
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground mb-3">
                  <li><code className="bg-muted px-1 rounded">Operation</code> - {language === "ar" ? "نوع العملية" : "Operation type"}</li>
                  <li><code className="bg-muted px-1 rounded">Operator</code> - {language === "ar" ? "اسم المستخدم" : "User name"}</li>
                  <li><code className="bg-muted px-1 rounded">Time</code> - {language === "ar" ? "التاريخ والوقت" : "Date and time"}</li>
                  <li><code className="bg-muted px-1 rounded">Source</code> - {language === "ar" ? "المصدر" : "Source"}</li>
                  <li><code className="bg-muted px-1 rounded">Details</code> - {language === "ar" ? "التفاصيل (اختياري)" : "Details (optional)"}</li>
                </ul>
                
                <p className="text-sm font-medium text-foreground mb-2">
                  {language === "ar" ? "الصيغة الثانية (Standard Logs):" : "Format 2 (Standard Logs):"}
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li><code className="bg-muted px-1 rounded">employeeId</code> - {language === "ar" ? "معرف الموظف" : "Employee ID"}</li>
                  <li><code className="bg-muted px-1 rounded">timestamp</code> - {language === "ar" ? "التاريخ والوقت" : "Date and time"}</li>
                  <li><code className="bg-muted px-1 rounded">source</code> - {language === "ar" ? "المصدر" : "Source"}</li>
                  <li><code className="bg-muted px-1 rounded">action</code> - {language === "ar" ? "الإجراء" : "Action"}</li>
                  <li><code className="bg-muted px-1 rounded">details</code> - {language === "ar" ? "التفاصيل (اختياري)" : "Details (optional)"}</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {language === "ar" 
                    ? "💡 النظام يتعرف تلقائياً على صيغة الملف ويحولها للشكل المناسب" 
                    : "💡 The system automatically detects the file format and converts it accordingly"}
                </p>
              </div>
            </CardContent>
          </Card>

          <FileUploader />
        </div>
      </div>
    </div>
  );
}
