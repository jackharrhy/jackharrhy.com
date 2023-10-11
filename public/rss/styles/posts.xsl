<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes" />
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <title>RSS Feed | <xsl:value-of select="/rss/channel/title" />
        </title>
        <link rel="stylesheet" href="/rss/styles/posts.css" />
      </head>
      <body>
        <main>
          <h1>
            <strong>
              <xsl:value-of select="/rss/channel/title" />
            </strong>
          </h1>
          <p>
            <xsl:value-of select="/rss/channel/description" />
          </p>
          <section>
            <xsl:for-each select="/rss/channel/item">
              <article>
                <xsl:value-of select="substring(pubDate, 0, 17)" />
                <a>
                  <xsl:attribute name="href">
                    <xsl:value-of select="link" />
                  </xsl:attribute>
                  <xsl:value-of select="title" />
                </a>
              </article>
            </xsl:for-each>
          </section>
          <p>this is an RSS feed, visit <a href="https://aboutfeeds.com">about feeds</a> to learn
  more and get started </p>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
