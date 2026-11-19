const GRADIENTS = [
  "from-teal-400 to-cyan-600",
  "from-green-500 to-emerald-700",
  "from-purple-400 to-violet-600",
  "from-orange-400 to-rose-500",
  "from-blue-400 to-indigo-600",
  "from-pink-400 to-fuchsia-600",
];

export function getRoomGradient(roomId: string): string {
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    hash = (hash * 31 + roomId.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}
