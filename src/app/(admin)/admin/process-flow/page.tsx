import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessFlowDiagram } from "@/components/admin/ProcessFlowDiagram";

export default function ProcessFlowPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>End-to-End Process Flow</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[560px]">
            <ProcessFlowDiagram />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
