import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';

interface MyDocumentProps extends DocumentInitialProps {
  nonce?: string;
}

class MyDocument extends Document<MyDocumentProps> {
  static async getInitialProps(ctx: DocumentContext): Promise<MyDocumentProps> {
    const initialProps = await Document.getInitialProps(ctx);
    // Read nonce from middleware
    const nonce = ctx.res?.getHeader('x-nonce') as string | undefined;
    return { ...initialProps, nonce };
  }

  render() {
    // Access nonce from props and pass to NextScript
    const { nonce } = this.props;
    
    return (
      <Html lang="en">
        <Head>
          <meta
            name="description"
            content="LiquiLab - Manage your liquidity pools on Flare Network."
          />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Quicksand:wght@400;600;700&display=swap" rel="stylesheet" />
        </Head>
        <body className="antialiased">
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
