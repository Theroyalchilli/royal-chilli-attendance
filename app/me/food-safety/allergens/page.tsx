// The 14 allergens UK/EU food businesses are legally required to declare —
// same list and order as royal-chilli-pos's lib/allergens.ts, so the two
// apps never drift. This is an awareness reference only: which dishes
// actually contain which allergen lives in the POS's menu matrix — check
// with the kitchen or a manager for a specific dish.
const ALLERGENS: { name: string; label: string; examples: string; icon: string }[] = [
  { name: "celery", label: "Celery", examples: "celery, celeriac, celery salt", icon: "🥬" },
  { name: "gluten", label: "Cereals containing gluten", examples: "wheat, rye, barley, naan, roti", icon: "🌾" },
  { name: "crustaceans", label: "Crustaceans", examples: "prawns, crab, lobster", icon: "🦐" },
  { name: "eggs", label: "Eggs", examples: "egg, mayonnaise, some breads", icon: "🥚" },
  { name: "fish", label: "Fish", examples: "fish, fish sauce, Worcestershire sauce", icon: "🐟" },
  { name: "lupin", label: "Lupin", examples: "lupin flour/seeds, some breads", icon: "🌱" },
  { name: "milk", label: "Milk", examples: "milk, cream, ghee, paneer, yoghurt", icon: "🥛" },
  { name: "molluscs", label: "Molluscs", examples: "mussels, squid, oysters", icon: "🐚" },
  { name: "mustard", label: "Mustard", examples: "mustard seeds, mustard oil", icon: "🌶️" },
  { name: "nuts", label: "Tree nuts", examples: "almonds, cashews, pistachios", icon: "🌰" },
  { name: "peanuts", label: "Peanuts", examples: "peanuts, peanut/groundnut oil", icon: "🥜" },
  { name: "sesame", label: "Sesame", examples: "sesame seeds, tahini", icon: "◯" },
  { name: "soya", label: "Soya", examples: "soy sauce, tofu, edamame", icon: "🫘" },
  { name: "sulphites", label: "Sulphur dioxide / sulphites", examples: "dried fruit, some sauces & wine", icon: "🍇" },
];

export default function AllergensReference() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Allergens</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The 14 allergens we&apos;re legally required to know about. This is a general reference —
        for what&apos;s actually in a specific dish, check the kitchen or a manager.
      </p>

      <div className="mt-5 space-y-2">
        {ALLERGENS.map((a) => (
          <div key={a.name} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-amber-50 text-lg">{a.icon}</span>
            <div className="min-w-0">
              <p className="font-medium text-neutral-800">{a.label}</p>
              <p className="text-xs text-neutral-400">{a.examples}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        A customer asking about allergies? Always confirm with the kitchen before answering — don&apos;t guess.
      </p>
    </div>
  );
}
