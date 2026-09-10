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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PosterEntry } from "../types";
import { GripIcon } from "./icons";

interface SortableRowProps {
  item: PosterEntry;
}

// Only the handle gets the sortable listeners/attributes (and the CSS
// touch-action: none they depend on) — the row itself just carries the
// drag transform. That's what lets a press anywhere else in the row keep
// behaving as normal page scroll instead of racing dnd-kit's own pointer
// sensor for the gesture.
function SortableRow({ item }: SortableRowProps) {
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
      className={`reorder-row ${isDragging ? "is-dragging" : ""}`}
    >
      <button
        type="button"
        className="reorder-row__handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      <p className="reorder-row__title">{item.title}</p>
    </div>
  );
}

interface ReorderableListProps {
  items: PosterEntry[];
  onReorder: (orderedIds: string[]) => void;
}

// Compact, poster-free counterpart to ReorderableGrid for lists long
// enough that seeing only a few 3-column tiles at once (and risking a
// scroll gesture landing on a tile instead of the page) makes reordering
// hard. Same dnd-kit setup, just a vertical list with drag confined to a
// per-row handle — see ReorderableGrid's own comment for why PointerSensor
// alone (no separate TouchSensor) is the right sensor configuration.
export function ReorderableList({ items, onReorder }: ReorderableListProps) {
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
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="reorder-list">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
