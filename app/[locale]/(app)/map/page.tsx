import { setRequestLocale } from "next-intl/server";
import { getMapData } from "@/lib/queries/map";
import { MapView } from "@/components/map/map-view";

export default async function MapPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const data = await getMapData();
  return <MapView {...data} />;
}
