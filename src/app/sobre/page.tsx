import type { Metadata } from 'next';
import styles from './sobre.module.css';

export const metadata: Metadata = {
  title: 'Sobre e como rodar · Eu avaliei!',
  description:
    'Código aberto sob licença MIT. Como rodar na sua máquina ou hospedar sua própria instância.',
};

const REPO = 'https://github.com/fmssec/eu-avaliei';

/**
 * Página de "sobre" com as instruções de rodar localmente.
 *
 * Ela existe no site, e não só no README, porque quem descobre o projeto pelo
 * card compartilhado não vai ao GitHub — e a proposta de ser aberto só é real
 * se o caminho para rodar estiver visível para quem está usando.
 */
export default function Sobre() {
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <a className={styles.wordmark} href="/">
          Eu avaliei!
        </a>
        <a className={styles.voltar} href="/">
          ← VOLTAR
        </a>
      </header>

      <section>
        <h1 className={styles.titulo}>Código aberto</h1>
        <p className={styles.texto}>
          Este site é software livre, sob licença MIT. O código está no{' '}
          <a href={REPO}>GitHub</a> e você pode rodar na sua máquina, modificar
          e hospedar a sua própria instância — inclusive com as suas chaves de API.
        </p>
        <p className={styles.texto}>
          Nada do que você avalia é enviado para um servidor. O card existe
          enquanto está sendo feito e vira a imagem que você leva embora; o seu
          catálogo fica guardado no seu navegador, neste aparelho.
        </p>
      </section>

      <section className={styles.bloco}>
        <h2 className={styles.subtitulo}>Rodar na sua máquina</h2>
        <p className={styles.texto}>
          Precisa de <a href="https://nodejs.org">Node.js 22</a> ou mais novo.
        </p>
        <pre className={styles.codigo}>
          <code>{`git clone ${REPO}.git
cd eu-avaliei
npm install
npm run dev`}</code>
        </pre>
        <p className={styles.texto}>
          Abre em <code className={styles.inline}>http://localhost:3000</code> e
          funciona sem nenhuma chave de API — a busca traz livros pela Open
          Library, que é aberta.
        </p>
      </section>

      <section className={styles.bloco}>
        <h2 className={styles.subtitulo}>Com Docker</h2>
        <pre className={styles.codigo}>
          <code>docker compose up --build</code>
        </pre>
        <p className={styles.texto}>
          Instala tudo dentro da imagem, sem precisar de Node na sua máquina.
        </p>
      </section>

      <section className={styles.bloco}>
        <h2 className={styles.subtitulo}>Ligar filmes, séries e jogos</h2>
        <p className={styles.texto}>
          Copie <code className={styles.inline}>.env.example</code> para{' '}
          <code className={styles.inline}>.env.local</code> e preencha o que
          quiser usar. Cada fonte é independente: sem a chave, aquela categoria
          simplesmente não aparece na busca.
        </p>
        <div className={styles.tabela}>
          <div className={styles.linha}>
            <span className={styles.celulaChave}>Livros</span>
            <span className={styles.celula}>
              <a href="https://openlibrary.org/developers/api">Open Library</a> — não
              precisa de chave
            </span>
          </div>
          <div className={styles.linha}>
            <span className={styles.celulaChave}>Filmes e séries</span>
            <span className={styles.celula}>
              <a href="https://developer.themoviedb.org">TMDB</a> —{' '}
              <code className={styles.inline}>TMDB_API_KEY</code> e{' '}
              <code className={styles.inline}>MEDIA_PROVIDER=tmdb</code>
            </span>
          </div>
          <div className={styles.linha}>
            <span className={styles.celulaChave}>Jogos</span>
            <span className={styles.celula}>
              <a href="https://api-docs.igdb.com/">IGDB</a> —{' '}
              <code className={styles.inline}>TWITCH_CLIENT_ID</code> e{' '}
              <code className={styles.inline}>TWITCH_CLIENT_SECRET</code>, de um app
              registrado na Twitch
            </span>
          </div>
        </div>
      </section>

      <section className={styles.bloco}>
        <h2 className={styles.subtitulo}>Hospedar a sua instância</h2>
        <p className={styles.texto}>
          O repositório traz um <code className={styles.inline}>render.yaml</code>:
          no Render, escolha <strong>New → Blueprint</strong> e aponte para o seu
          fork. Ele cria o serviço configurado, restando só digitar as chaves.
          Qualquer plataforma que rode um container Docker também serve.
        </p>
        <p className={styles.texto}>
          As instruções completas, com as ressalvas de cada plataforma, estão no{' '}
          <a href={`${REPO}#readme`}>README</a>.
        </p>
      </section>

      <section className={styles.bloco}>
        <h2 className={styles.subtitulo}>Sobre os dados</h2>
        <p className={styles.texto}>
          Os metadados vêm do TMDB, da Open Library e do IGDB. Capas e pôsteres
          são obra dos estúdios e editoras, não das APIs — por isso dá para
          anexar a sua própria imagem, e por isso nenhuma arte de terceiro está
          versionada no repositório.
        </p>
        <p className={styles.texto}>
          Este site usa o TMDB e as APIs do TMDB, mas não é endossado,
          certificado ou aprovado pelo TMDB.
        </p>
      </section>

      <footer className={styles.rodape}>
        <span>DESENVOLVIDO POR FZ</span>
        <a href={REPO}>CÓDIGO NO GITHUB</a>
      </footer>
    </main>
  );
}
