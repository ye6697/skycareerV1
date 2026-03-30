import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from '@/api/base44Client';
import { useLanguage } from "@/components/LanguageContext";
import { Percent, DollarSign } from "lucide-react";

export default function CreateDiscountForm({ onSuccess, onCancel }) {
  const { lang } = useLanguage();
  const de = lang === 'de';

  const [form, setForm] = useState({
    name: '',
    code: '',
    amount: '',
    amount_type: 'percent',
    max_redemptions: '',
    expires_at: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name || !form.code || !form.amount) {
      setError(de ? 'Bitte alle Pflichtfelder ausfüllen' : 'Please fill all required fields');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await base44.functions.invoke('lemonsqueezyDiscounts', {
        action: 'create',
        name: form.name,
        code: form.code,
        amount: Number(form.amount),
        amount_type: form.amount_type,
        max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : 0,
        expires_at: form.expires_at || null,
      });
      onSuccess();
    } catch (e) {
      setError(e.message || 'Error');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 font-mono uppercase">{de ? 'Name (intern)' : 'Name (internal)'} *</label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={de ? 'z.B. Launch-Rabatt' : 'e.g. Launch Discount'}
          className="bg-slate-800 border-slate-600 mt-1"
        />
      </div>

      <div>
        <label className="text-xs text-slate-400 font-mono uppercase">{de ? 'Gutscheincode' : 'Discount Code'} *</label>
        <Input
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="LAUNCH20"
          className="bg-slate-800 border-slate-600 mt-1 font-mono uppercase"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 font-mono uppercase">{de ? 'Rabatt' : 'Discount'} *</label>
          <Input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="20"
            className="bg-slate-800 border-slate-600 mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 font-mono uppercase">{de ? 'Typ' : 'Type'}</label>
          <div className="flex gap-2 mt-1">
            <Button
              type="button"
              variant={form.amount_type === 'percent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setForm({ ...form, amount_type: 'percent' })}
              className={form.amount_type === 'percent' ? 'bg-cyan-700 hover:bg-cyan-600' : 'border-slate-600 text-slate-400'}
            >
              <Percent className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={form.amount_type === 'fixed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setForm({ ...form, amount_type: 'fixed' })}
              className={form.amount_type === 'fixed' ? 'bg-cyan-700 hover:bg-cyan-600' : 'border-slate-600 text-slate-400'}
            >
              <DollarSign className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 font-mono uppercase">
          {de ? 'Max. Einlösungen (0 = unbegrenzt)' : 'Max Redemptions (0 = unlimited)'}
        </label>
        <Input
          type="number"
          value={form.max_redemptions}
          onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })}
          placeholder="0"
          className="bg-slate-800 border-slate-600 mt-1"
        />
      </div>

      <div>
        <label className="text-xs text-slate-400 font-mono uppercase">
          {de ? 'Ablaufdatum (optional)' : 'Expires at (optional)'}
        </label>
        <Input
          type="datetime-local"
          value={form.expires_at}
          onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
          className="bg-slate-800 border-slate-600 mt-1"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="border-slate-600 text-slate-300">
          {de ? 'Abbrechen' : 'Cancel'}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-cyan-700 hover:bg-cyan-600 text-white font-mono"
        >
          {submitting ? (de ? 'Erstelle...' : 'Creating...') : (de ? 'Erstellen' : 'Create')}
        </Button>
      </div>
    </div>
  );
}