# RESISTANCE TRAINING INTEGRATION — RUNBOOK

Quick-start guide para cada slice.

---

## ANTES DE COMEÇAR

```bash
# Ambiente pronto?
npm install                    # Deps
npm run lint                   # Sem erros
npx jest src/core/resistance  # Testes de resist passando?

# Branch preparado?
git checkout -b feat/resistance-ui-slice-a1

# Se der erro de Jest, limpe:
npm run jest -- --clearCache
```

---

## SLICE A1: SessionResistanceBlock

### Passo 1: Criar o componente

**File:** `src/screens/session/components/SessionResistanceBlock.tsx`

```typescript
import React from 'react';
import { View, Text, FlatList } from 'react-native';
import type { ResistanceTrainingPlan } from '../../../core/models';

export type SessionResistanceBlockProps = {
  resistancePlan: ResistanceTrainingPlan;
  durationMin: number;
};

export function SessionResistanceBlock(props: SessionResistanceBlockProps) {
  const { resistancePlan, durationMin } = props;

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
        {resistancePlan.label}
      </Text>
      
      <Text style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        Transferência: {resistancePlan.transferTarget}
      </Text>

      {/* Tabela de exercícios */}
      <ExercisePrescriptionTable exercises={resistancePlan.exercises} />
      
      <Text style={{ fontSize: 12, color: '#999', marginTop: 16 }}>
        Duração: {durationMin} min
      </Text>
    </View>
  );
}

function ExercisePrescriptionTable(props: { exercises: any[] }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: '#ddd' }}>
      {props.exercises.map((ex, idx) => (
        <View key={idx} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
          <Text style={{ fontWeight: '500' }}>{ex.name}</Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            {ex.sets} × {ex.reps} — {ex.rest}
          </Text>
          {ex.notes && (
            <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              📝 {ex.notes}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
```

### Passo 2: Refatorar session.tsx

**Arquivo:** `app/class/[id]/session.tsx`

Encontre onde renderiza o plano. Adicione condicional:

```typescript
// Near the render logic:

const renderSessionContent = () => {
  if (!dailyLesson) return null;
  
  // NEW: Check for resistance session
  if (dailyLesson.sessionEnvironment === 'academia') {
    const sessionComponent = dailyLesson.sessionComponents?.find(
      (c) => c.type === 'academia_resistido'
    );
    if (sessionComponent && 'resistancePlan' in sessionComponent) {
      return (
        <SessionResistanceBlock
          resistancePlan={sessionComponent.resistancePlan}
          durationMin={sessionComponent.durationMin}
        />
      );
    }
  }

  // EXISTING: Quadra render (leave as-is)
  return renderQuadraContent();
};
```

### Passo 3: Testes

**File:** `src/screens/session/components/__tests__/SessionResistanceBlock.test.tsx`

```typescript
import { render } from '@testing-library/react-native';
import { SessionResistanceBlock } from '../SessionResistanceBlock';

describe('SessionResistanceBlock', () => {
  it('renders exercise table', () => {
    const plan = {
      label: 'Força Base',
      transferTarget: 'Bloqueio',
      exercises: [
        { name: 'Supino', sets: 3, reps: '8-10', rest: '90s', notes: 'Pausa 2-0-2' },
      ],
    };

    const { getByText } = render(
      <SessionResistanceBlock resistancePlan={plan} durationMin={45} />
    );

    expect(getByText('Supino')).toBeTruthy();
    expect(getByText('3 × 8-10 — 90s')).toBeTruthy();
  });
});
```

### Passo 4: Validar

```bash
npm run lint src/screens/session/components/SessionResistanceBlock.tsx
npm run jest src/screens/session/components/__tests__/SessionResistanceBlock.test.tsx
npx expo start --web  # Visual check
```

---

## SLICE A2: SessionContextHeader

### Passo 1: Criar header

**File:** `src/screens/session/components/SessionContextHeader.tsx`

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import type {
  SessionEnvironment,
  WeeklyPhysicalEmphasis,
  CourtGymRelationship,
} from '../../../core/models';

export type SessionContextHeaderProps = {
  environment: SessionEnvironment;
  physicalEmphasis?: WeeklyPhysicalEmphasis;
  courtGymRelationship?: CourtGymRelationship;
  transferTarget?: string;
};

export function SessionContextHeader(props: SessionContextHeaderProps) {
  const {
    environment,
    physicalEmphasis = 'manutencao',
    courtGymRelationship = 'quadra_dominante',
    transferTarget,
  } = props;

  const environmentLabel = {
    quadra: '🏐 Quadra',
    academia: '🏋️ Academia',
    mista: '🔄 Mista',
    preventiva: '🛡️ Preventiva',
  }[environment];

  const emphasislabel = {
    forca_base: 'Força Base',
    potencia_atletica: 'Potência',
    resistencia_especifica: 'Resistência',
    velocidade_reatividade: 'Velocidade',
    prevencao_recuperacao: 'Prevenção',
    manutencao: 'Manutenção',
  }[physicalEmphasis];

  return (
    <View style={{ backgroundColor: '#f5f5f5', padding: 12, marginBottom: 16, borderRadius: 8 }}>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
          Contexto da Sessão
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Chip label={environmentLabel} />
        <Chip label={emphasislabel} />
        {transferTarget && <Chip label={`→ ${transferTarget}`} />}
      </View>
    </View>
  );
}

function Chip(props: { label: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '500', color: '#333' }}>
      • {props.label}
    </Text>
  );
}
```

### Passo 2: Integrar em session.tsx

```typescript
// No render do plano, adicione no topo:

<SessionContextHeader
  environment={dailyLesson.sessionEnvironment ?? 'quadra'}
  physicalEmphasis={weeklyContext?.weeklyPhysicalEmphasis}
  courtGymRelationship={weeklyContext?.courtGymRelationship}
  transferTarget={getTransferTarget(dailyLesson)}
/>
```

### Passo 3: Testes + validar

```bash
npm run jest src/screens/session/components/__tests__/SessionContextHeader.test.tsx
```

---

## SLICE B1: Gerador Escreve Contexto

### Passo 1: Verificar que buildWeeklyIntegratedContext existe

**File:** `src/core/resistance/resolve-session-environment.ts`

Procure por `buildWeeklyIntegratedContext`. Deve retornar:

```typescript
{
  weeklyPhysicalEmphasis: WeeklyPhysicalEmphasis,
  courtGymRelationship: CourtGymRelationship,
  gymSessionsCount: number,
  interferenceRisk: "baixo" | "moderado" | "alto",
}
```

### Passo 2: Refatorar build-auto-week-plan.ts

Encontre onde salva `ClassPlan`. Adicione:

```typescript
import { resolveTeamTrainingContext } from '../../resistance/training-context';
import { buildWeeklyIntegratedContext } from '../../resistance/resolve-session-environment';

// Inside the week generation:
const teamContext = resolveTeamTrainingContext(classGroup);
const weeklyContext = buildWeeklyIntegratedContext({
  teamContext,
  weeklySessions: classGroup.daysPerWeek,
  weeklyPhysicalEmphasis: determinedEmphasis, // from periodization
});

// Save to classplan:
const classplan = {
  // ... existing fields
  weeklyIntegratedContextJson: JSON.stringify(weeklyContext),
};

saveClassPlan(classplan);
```

### Passo 3: Refatorar build-auto-plan-for-cycle-day.ts

```typescript
import { resolveSessionEnvironment } from '../../resistance/resolve-session-environment';

// Inside cycle day building:
const sessionEnv = resolveSessionEnvironment({
  teamContext,
  weeklySessions: classGroup.daysPerWeek,
  sessionIndexInWeek: sessionIndex,
});

// Chamar gerador resistido se academy:
if (sessionEnv === 'academia') {
  const resistancePlan = buildResistanceSessionPlan({
    goal: classGroup.goal,
    profile: teamContext.resistanceTrainingProfile,
    emphasis: weeklyContext.weeklyPhysicalEmphasis,
  });

  dailyLesson.sessionComponents = [
    {
      type: 'academia_resistido',
      resistancePlan,
      durationMin: 45,
    },
  ];
}

dailyLesson.sessionEnvironment = sessionEnv;
saveDailyLesson(dailyLesson);
```

### Passo 4: Testar

```bash
# Gere um plano para turma com academia
npm run jest src/core/session-generator/__tests__/

# Verificar no DB:
sqlite> SELECT weeklyIntegratedContextJson FROM class_plans LIMIT 1;
```

---

## SLICE B2: Énfase Dirige Template

### Passo 1: Revisar resistance-templates.ts

Procure por `resolveResistanceTemplate`. Deve aceitar:

```typescript
function resolveResistanceTemplate(
  goal: Goal,
  profile: ResistanceTrainingProfile,
  emphasis: WeeklyPhysicalEmphasis,
): ResistanceTrainingPlan { ... }
```

### Passo 2: Refatorar seletor de template

```typescript
// Antes de chamar buildResistanceSessionPlan:
const template = resolveResistanceTemplate(
  classGroup.goal,
  teamContext.resistanceTrainingProfile,
  weeklyContext.weeklyPhysicalEmphasis,  // ← NEW
);
```

### Passo 3: Testar

```bash
npm run jest src/core/resistance/__tests__/resistance-templates.test.ts
```

---

## SLICE C1: Sinais QA

### Passo 1: Criar observables

**File:** `src/core/recommendation/gym-court-observables.ts`

```typescript
import type { WeeklyIntegratedTrainingContext } from '../../core/models';

export type GymCourtSignal = {
  severity: 'low' | 'medium' | 'high';
  code: string;
  reason: string;
};

export function observeGymCourtInterference(
  context: WeeklyIntegratedTrainingContext
): GymCourtSignal | null {
  if (context.interferenceRisk === 'alto') {
    return {
      severity: 'medium',
      code: 'interference_risk',
      reason: `Academia com foco em potência + quadra com alta demanda de salto. Monitorar fadiga acumulada.`,
    };
  }
  return null;
}
```

### Passo 2: Expor em QA

**File:** `src/ui/QA/ResistanceIntegrationPanel.tsx` (novo)

```typescript
export function ResistanceIntegrationPanel(props: { signals: GymCourtSignal[] }) {
  return (
    <View style={{ padding: 12, backgroundColor: '#fff9e6', borderRadius: 8 }}>
      <Text style={{ fontWeight: '600', marginBottom: 8 }}>
        🔍 Observação: Integração Quadra × Academia
      </Text>
      {props.signals.map((signal) => (
        <Text key={signal.code} style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
          • {signal.reason}
        </Text>
      ))}
    </View>
  );
}
```

### Passo 3: Testar

```bash
npm run jest src/core/recommendation/__tests__/gym-court-observables.test.ts
```

---

## VALIDAÇÃO FINAL

```bash
# Todos os testes?
npm run jest

# Lint limpo?
npm run lint

# Build completa?
npm run build

# Visual check (web)?
npx expo start --web
```

---

**Status:** Ready to run  
**Last Updated:** 23/04/2026
