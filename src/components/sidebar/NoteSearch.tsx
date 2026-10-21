import React from "react";
import { Search } from "lucide-react";

type NoteSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

export default function NoteSearch({ query, onQueryChange }: NoteSearchProps) {
  return (
    <div className="search-wrap">
      <mdui-text-field
        variant="outlined"
        placeholder="搜索笔记..."
        value={query}
        onInput={(e: React.FormEvent<HTMLElement>) => {
          const target = e.target as HTMLInputElement;
          onQueryChange(target.value ?? "");
        }}
        clearable
        className="search-field"
      >
        <Search size={16} slot="icon" />
      </mdui-text-field>
    </div>
  );
}
