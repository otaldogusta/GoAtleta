import { Redirect } from "expo-router";

export default function ImportTrainingRoute() {
  return <Redirect href="/training?import=spreadsheet" />;
}
