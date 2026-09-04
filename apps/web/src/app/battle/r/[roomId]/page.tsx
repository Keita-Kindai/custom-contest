import { BattleRoom } from "@/app/_components/battle-room";

type RoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  return <BattleRoom roomId={roomId.toUpperCase()} />;
}
