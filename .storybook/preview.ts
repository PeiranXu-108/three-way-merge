// Ant Design 5 使用 CSS-in-JS，组件样式会自动注入。
// 若需基础样式重置，请在项目根目录安装 antd 后取消下一行注释：
// import 'antd/dist/reset.css';

const preview = {
  parameters: {
    layout: 'fullscreen',
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
