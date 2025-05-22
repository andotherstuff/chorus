import { useMarkdownWithoutFirstHeading } from "@/hooks/useMarkdownWithoutFirstHeading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/ui/Header";

export default function AboutPage() {
  const html = useMarkdownWithoutFirstHeading("/About.md");

  return (
    <div className="container mx-auto py-3 px-3 sm:px-4">
      <Header />
      
      <div className="max-w-3xl mx-auto mt-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-3xl font-bold">About +chorus</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose dark:prose-invert max-w-none
                         prose-headings:font-bold prose-headings:text-foreground
                         prose-h2:text-2xl prose-h3:text-xl
                         prose-p:text-base prose-p:leading-relaxed prose-p:text-foreground/90
                         prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                         prose-strong:text-foreground prose-strong:font-semibold
                         prose-li:marker:text-primary/70 prose-li:my-1 prose-li:text-foreground/90
                         prose-img:rounded-md prose-img:shadow-sm
                         prose-hr:border-border/40"
              dangerouslySetInnerHTML={{ __html: html }} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}