import React from "react";

type CoordinationAiSection = {
  heading: string;
  body: string;
};

export function CoordinationAiDocument(_: {
  title: string;
  generatedAt: string;
  sections: CoordinationAiSection[];
}) {
  return null;
}
