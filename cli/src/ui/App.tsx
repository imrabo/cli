import React from 'react'
import { Box, Text } from 'ink'

type AppProps = {
  title: string
  lines: string[]
}

export function App({ title, lines }: AppProps): React.JSX.Element {
  return (
    <Box flexDirection='column'>
      <Text>{title}</Text>
      {lines.map((line, index) => (
        <Text key={`${index}-${line.slice(0, 12)}`}>{line}</Text>
      ))}
    </Box>
  )
}
