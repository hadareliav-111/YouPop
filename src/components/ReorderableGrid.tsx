import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PosterEntry } from "../types";

interface SortableTileProps {
  item: PosterEntry;
}

function SortableTile({ item }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`reorder-tile ${isDragging ? "is-dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      {item.posterUrl ? (
        <img className="reorder-tile__poster" src={item.posterUrl} alt="" />
      ) : (
        <div className="reorder-tile__poster reorder-tile__poster--placeholder">🎬</div>
      )}
      <p className="reorder-tile__title">{item.title}</p>
    </div>
  );
}

interface ReorderableGridProps {
  items: PosterEntry[];
  onReorder: (orderedIds: string[]) => void;
}

export function ReorderableGrid({ items, onReorder }: ReorderableGridProps) {
  // PointerSensor alone (not paired with a separate TouchSensor) is the
  // configuration dnd-kit itself recommends for supporting mouse, touch and
  // pen uniformly — it handles all three via the unified Pointer Events
  // API. Registering both a PointerSensor and a TouchSensor at once (the
  // previous setup here) makes both sensors race to claim the same real
  // touch interaction; the TouchSensor's stricter delay+tolerance
  // activation constraint can end up winning that race and then failing
  // it, silently swallowing the drag on real touchscreens even though
  // mouse-driven testing looks fine. A small distance-based constraint
  // (not a delay) also matches "press and drag" rather than "long-press,
  // then drag".
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex).map((i) => i.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="reorder-grid">
          {items.map((item) => (
            <SortableTile key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
