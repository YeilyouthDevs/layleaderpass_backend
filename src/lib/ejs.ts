import { projectRoot, TEMPLATE_ROOT } from "@/configs/envConfig";
import ejs from "ejs";
import path from "path";

export async function renderTemplate(templateName: string, data: object) {
  const templatePath = path.join(
    projectRoot,
    TEMPLATE_ROOT,
    templateName + ".ejs"
  );

  const rendered = await ejs.renderFile(templatePath, data);
  return rendered;
}


