export async function getServerSideProps() {
  return { redirect: { destination: '/inbox?folder=sent', permanent: false } };
}

export default function OutboxRedirect() {
  return null;
}
