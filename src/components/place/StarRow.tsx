import { Star } from "lucide-react";

export function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${
            i <= Math.round(rating) ? "fill-[#FDC700] text-[#FDC700]" : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}
