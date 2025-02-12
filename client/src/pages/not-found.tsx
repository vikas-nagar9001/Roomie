import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg rounded-lg bg-white">
        <CardContent className="py-8 px-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 - Page Not Found</h1>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed">
            Oops! It looks like this page doesn't exist. <br />
            Did you forget to add it to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
