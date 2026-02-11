import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { ThreeWayDiffEditor } from '../index';

const oldContent = `{
  "name": "ExampleConfig",
  "version": 1,
  "features": {
    "search": true,
    "share": false,
    "export": false
  },
  "limits": {
    "maxItems": 50,
    "timeout": 5000
  },
  "theme": {
    "primary": "#1890ff",
    "mode": "light"
  },
  "metadata": {
    "owner": "team-a",
    "createdAt": "2023-06-01"
  }
}`;

const newContent = `{
  "name": "ExampleConfig",
  "version": 2,
  "features": {
    "search": true,
    "share": true,
    "export": true
  },
  "limits": {
    "maxItems": 100,
    "timeout": 3000
  },
  "theme": {
    "primary": "#1677ff",
    "mode": "light"
  },
  "metadata": {
    "owner": "team-b",
    "createdAt": "2024-01-15",
    "updatedAt": "2025-02-10"
  }
}`;

const meta: Meta<typeof ThreeWayDiffEditor> = {
  title: 'ThreeWayDiffEditor',
  component: ThreeWayDiffEditor,
};

export default meta;

type Story = StoryObj<typeof ThreeWayDiffEditor>;

export const Default: Story = {
  render: () => {
    const [merged, setMerged] = useState('');
    return (
      <div style={{ padding: 16 }}>
        <ThreeWayDiffEditor oldContent={oldContent} newContent={newContent} onChange={setMerged} />
        <div style={{ marginTop: 16, fontSize: 12, color: '#5f6c7b' }}>当前合并内容：</div>
        <pre
          style={{
            marginTop: 8,
            padding: 12,
            background: '#fff',
            border: '1px solid #e6e9f0',
            borderRadius: 6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {merged || '（暂无更改）'}
        </pre>
      </div>
    );
  },
};
