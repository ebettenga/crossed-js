
import { observer } from "mobx-react-lite"
import { View, ViewStyle } from "react-native"
import { Button, Screen, Text } from "@/components"
import { ThemedStyle } from "@/theme"
import { useAppTheme } from "@/utils/useAppTheme"
import { Href, Link } from "expo-router"



type DifficultyButton = {
    testID: string
    label: string
    log: string
    link: Href
}

const difficultyButtons: DifficultyButton[] = [
    { testID: "difficulty-easy-button", label: "Easy", log: "easy", link: "./easy" },
    { testID: "difficulty-medium-button", label: "Medium", log: "medium", link: "./medium" },
    { testID: "difficulty-hard-button", label: "Hard", log: "hard", link: "./hard" },
]

export default observer(function DifficultyScreen() {
  const { themed } = useAppTheme()

  return (
    <Screen safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View style={themed($buttonContainer)}>
        {difficultyButtons.map((button, index) => (
          <View key={index} style={{ position: "relative", width: "50%", maxWidth: 500, minWidth: 200 }}>
            <Link href={button.link} style={{ width: "100%" }}>
              <Button
                testID={button.testID}
                style={{ width: "100%" }}
                text={button.label}
                onPress={() => {
                  console.log(button.log)
                }}
              />
            </Link>
          </View>
        ))}
      </View>
    </Screen>
  )
})

const $container: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  backgroundColor: colors.background,
})

const $buttonContainer: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexShrink: 1,
  flexGrow: 1,
  flexBasis: "50%",
  backgroundColor: colors.palette.neutral800,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  paddingHorizontal: spacing.xxl,
  justifyContent: "space-around",
  alignItems: "center",
})
