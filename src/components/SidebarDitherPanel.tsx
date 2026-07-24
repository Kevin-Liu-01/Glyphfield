export default function SidebarDitherPanel() {
  return (
    <div className='project-dither-panel sidebar-dither-panel' aria-hidden='true'>
      <span className='project-dither-field' />
      <span className='project-dither-sweep' />
      <span className='project-dither-symbols'>
        <span>G</span>
        <span>ϟ</span>
        <span>@</span>
        <span>{'{ }'}</span>
      </span>
    </div>
  );
}
