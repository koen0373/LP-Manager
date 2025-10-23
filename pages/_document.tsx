import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    // Read nonce from middleware
    const nonce = ctx.res?.getHeader('x-nonce') as string | undefined;
    return { ...initialProps, nonce };
  }

  render() {
    // Access nonce from props and pass to NextScript
    const nonce = (this.props as any).nonce as string | undefined;
    
    return (
      <Html lang="en">
        <Head>
          <meta name="description" content="Manage your Enosys V3 liquidity positions on Flare Network" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;700&display=swap" rel="stylesheet" />
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