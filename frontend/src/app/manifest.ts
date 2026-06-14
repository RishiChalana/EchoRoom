import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EchoRoom",
    short_name: "EchoRoom",
    description: "Practice how you speak. Before it matters.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f9fa",
    theme_color: "#000000",
    icons: [
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
