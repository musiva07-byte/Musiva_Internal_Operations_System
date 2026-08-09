"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createCategoryAction } from "@/app/admin/products/actions";
import { validateNewCategoryName } from "@/lib/validations/category.schema";
import type { CategoryRow } from "@/types/database";

const ADD_NEW_CATEGORY_VALUE = "__add_new_category__";

type CategorySelectProps = {
  id?: string;
  categories: CategoryRow[];
  value: string;
  onChange: (categoryId: string) => void;
  /** Name of the currently-selected category if it isn't in `categories` (e.g. an
   *  existing product pointing at an archived/renamed category). Shown as a synthetic
   *  option so the field still displays a real selection instead of silently falling
   *  back to "Uncategorized" and losing the product's actual category on save. */
  currentCategoryName?: string | null;
  disabled?: boolean;
};

export function CategorySelect({
  id,
  categories: initialCategories,
  value,
  onChange,
  currentCategoryName,
  disabled,
}: CategorySelectProps) {
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const knownIds = new Set(categories.map((category) => category.id));
  const hasUnknownSelection = Boolean(value) && !knownIds.has(value);

  // Briefly show the success message, then close on its own — staff never has to
  // click an extra "Close" button after saving.
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setOpen(false), 700);
    return () => clearTimeout(timer);
  }, [success]);

  function resetDialogState() {
    setName("");
    setError(null);
    setSuccess(false);
  }

  function handleSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (next === ADD_NEW_CATEGORY_VALUE) {
      resetDialogState();
      setOpen(true);
      return;
    }
    onChange(next);
  }

  function handleSave() {
    const validationError = validateNewCategoryName(
      name,
      categories.map((category) => category.name),
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createCategoryAction(name.trim());
      if (!result.ok || !result.category) {
        setError(result.error ?? "Category could not be created. Please try again.");
        return;
      }

      const created = result.category;
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      // Only the category field changes — every other already-entered field on the
      // surrounding product form is untouched, since this component never reaches
      // outside itself except through this single onChange call.
      onChange(created.id);
      setSuccess(true);
    });
  }

  return (
    <>
      <Select id={id} value={value} onChange={handleSelectChange} disabled={disabled}>
        <option value="">Uncategorized</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
        {hasUnknownSelection && (
          <option value={value}>{currentCategoryName ?? "Current category"}</option>
        )}
        <option value={ADD_NEW_CATEGORY_VALUE}>+ Add new category</option>
      </Select>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetDialogState();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-category-name">Category name</Label>
            <Input
              id="new-category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Kaftans"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm font-medium text-musiva-sage">Category added.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isPending} onClick={handleSave}>
              {isPending ? "Saving..." : "Save category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
