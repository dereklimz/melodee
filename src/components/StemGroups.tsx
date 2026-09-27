import { useState } from 'react';
import { useAppStore } from '../store/app';
import { StemLane } from './StemLane';
import './StemGroups.css';

const STEM_GROUPS = [
  {
    id: 'drums',
    label: 'Drums',
    color: '#FF6A55',
    lanes: ['kick', 'clap', 'hats', 'perc'],
  },
  {
    id: 'synth',
    label: 'Synth',
    color: '#8C7CFF',
    lanes: ['chords'],
  },
  {
    id: 'bass',
    label: 'Bass',
    color: '#8C7CFF',
    lanes: ['bass'],
  },
  {
    id: 'pad-lead',
    label: 'Pad & Lead',
    color: '#3DD6B5',
    lanes: ['pad', 'lead'],
    note: 'Lead here is pitched material in the drops — could be the sung hook, a pitched chop, or a lead synth.',
  },
  {
    id: 'vocals',
    label: 'Vocals',
    color: '#FF7EB6',
    lanes: ['vocal'],
  },
  {
    id: 'riser',
    label: 'Riser & FX',
    color: '#CFD6E0',
    lanes: ['ear-candy'],
  },
];

export function StemGroups() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(STEM_GROUPS.map((g) => g.id))
  );
  const analysis = useAppStore((state) => state.analysis);
  const openLane = useAppStore((state) => state.openLane);
  const laneSounds = useAppStore((state) => state.laneSounds);

  if (!analysis) return null;

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="stem-groups">
      {STEM_GROUPS.map((group) => {
        const groupLanes = analysis.lanes.filter((lane) => group.lanes.includes(lane.id));
        if (groupLanes.length === 0) return null;
        const isExpanded = expandedGroups.has(group.id);

        return (
          <div key={group.id} className="stem-group">
            <div
              className="stem-group-header"
              onClick={() => toggleGroup(group.id)}
              style={{ borderLeftColor: group.color }}
              title={group.note}
            >
              <span className="stem-group-toggle">{isExpanded ? '▼' : '▶'}</span>
              <span className="stem-group-label">{group.label}</span>
              <span className="stem-group-count">{groupLanes.length}</span>
            </div>

            {isExpanded && (
              <div className="stem-group-lanes">
                {groupLanes.map((lane) => (
                  <StemLane
                    key={lane.id}
                    lane={lane}
                    currentSound={laneSounds[lane.id]}
                    onOpen={() => openLane(lane.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
