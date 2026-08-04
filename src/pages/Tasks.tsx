import { useState } from "react";
import { Link } from "react-router-dom";
import { useBrands } from "@/hooks/useBrands";
import { useCreateTask, useDeleteTask, useTasks, useToggleTask } from "@/hooks/useTasks";
import { Button, Card, Empty, Input, Select } from "@/components/ui";
import { relativeDays } from "@/lib/format";
import clsx from "clsx";

export default function Tasks() {
  const { data: tasks, isLoading } = useTasks();
  const { data: brands } = useBrands();
  const create = useCreateTask();
  const toggle = useToggleTask();
  const del = useDeleteTask();

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [brandId, setBrandId] = useState("");

  const brandName = (id: string | null) => brands?.find((b) => b.id === id)?.name;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    create.mutate(
      { title: value, due_at: dueAt || null, brand_id: brandId || null },
      {
        onSuccess: () => {
          setTitle("");
          setDueAt("");
          setBrandId("");
        },
      },
    );
  }

  const open = (tasks ?? []).filter((t) => !t.done_at);
  const done = (tasks ?? []).filter((t) => t.done_at);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Uppgifter</h1>

      <Card>
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <Input
            className="min-w-48 flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Följ upp Verso på torsdag"
          />
          <Input
            type="date"
            className="w-40"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
          <Select className="w-44" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Inget varumärke</option>
            {(brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={create.isPending || !title.trim()}>
            Lägg till
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <p className="text-sm text-on-surface-variant">Laddar...</p>
      ) : !open.length && !done.length ? (
        <Empty title="Inga uppgifter än" />
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <ul className="space-y-2">
              {open.map((task) => (
                <li key={task.id}>
                  <Card className="flex items-center gap-3">
                    <button
                      onClick={() => toggle.mutate({ id: task.id, done: true })}
                      aria-label="Markera som klar"
                      className="h-5 w-5 shrink-0 rounded-full border-2 border-outline-variant hover:border-error"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{task.title}</p>
                      {task.brand_id && (
                        <Link
                          to={`/varumarken/${task.brand_id}`}
                          className="text-xs text-on-surface-variant hover:text-on-surface"
                        >
                          {brandName(task.brand_id)}
                        </Link>
                      )}
                    </div>
                    {task.due_at && (
                      <span
                        className={clsx(
                          "shrink-0 text-xs",
                          new Date(task.due_at) < new Date() ? "text-error" : "text-on-surface-variant",
                        )}
                      >
                        {relativeDays(task.due_at)}
                      </span>
                    )}
                    <button
                      onClick={() => del.mutate(task.id)}
                      aria-label="Ta bort"
                      className="shrink-0 text-on-surface-variant hover:text-error"
                    >
                      ✕
                    </button>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-on-surface-variant">Klara</h2>
              <ul className="space-y-2">
                {done.map((task) => (
                  <li key={task.id}>
                    <Card className="flex items-center gap-3 opacity-50">
                      <button
                        onClick={() => toggle.mutate({ id: task.id, done: false })}
                        aria-label="Ångra"
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] text-on-primary"
                      >
                        ✓
                      </button>
                      <p className="flex-1 truncate text-sm line-through">{task.title}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
