import { observer } from "mobx-react-lite"
import { Image, ImageStyle, TextStyle, View, ViewStyle } from "react-native"
import { Button, Screen, Text } from "@/components"
import { isRTL, TxKeyPath } from "@/i18n"
import { ThemedStyle } from "@/theme"
import { useSafeAreaInsetsStyle } from "@/utils/useSafeAreaInsetsStyle"
import { useAppTheme } from "@/utils/useAppTheme"
import { Href, Link } from "expo-router"

const welcomeLogo = require("../../assets/images/logo.png")
const welcomeFace = require("../../assets/images/welcome-face.png")

type WelcomeButton = {
  testID: string
  tx: TxKeyPath | undefined
  log: string
  link: Href<string | object>
}


export default observer(function WelcomeScreen() {
  const $bottomContainerInsets = useSafeAreaInsetsStyle(["bottom"])
  const { theme, themed } = useAppTheme()

  const buttons: WelcomeButton[] = [
    { testID: "welcome-next-screen-button", tx: "welcomeScreen:playButton", log: "play", link: "./difficulty" },
    { testID: "welcome-next-screen-button", tx: "welcomeScreen:howToButton", log: "how to play", link: './' },
    { testID: "welcome-next-screen-button", tx: "welcomeScreen:statsButton", log: "stats", link: "./" },
    { testID: "welcome-next-screen-button", tx: "welcomeScreen:settingsButton", log: "settings", link: "./" },
  ]

  return (
    <Screen safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      <View style={themed($topContainer)}>
        <Image style={themed($welcomeLogo)} source={welcomeLogo} resizeMode="contain" />
        {/* <Text
          testID="welcome-heading"
          style={themed($welcomeHeading)}
          tx="welcomeScreen:readyForLaunch"
          preset="heading"
        /> */}
        {/* <Text tx="welcomeScreen:exciting" preset="subheading" /> */}
        {/* <Image
          style={$welcomeFace}
          source={welcomeFace}
          resizeMode="contain"
          tintColor={theme.isDark ? theme.colors.palette.neutral900 : undefined}
        /> */}
      </View>

      <View style={themed($buttonContainer)}>
        {/* <Text tx="welcomeScreen:postscript" size="md" /> */}
        {buttons.map((button, index) => (
          <View key={index} style={{ position: "relative", width: "50%", maxWidth: 500, minWidth: 200 }}>
            {(index === 1 || index === 3) && (
              <Text size="xxs" style={themed($buttonNumber)}>{index + 1}</Text>
            )}
            <Link href={button.link} style={{ width: "100%" }}>
            <Button
              testID={button.testID}
              style={{ width: "100%" }}
              tx={button.tx}
              onPress={() => {
                console.log(button.log)
              }}
            />
            </Link>
          </View>
        ))}
      </View>
      <View style={themed([$bottomContainer, $bottomContainerInsets])} />
    </Screen>
  )
})

const $container: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  backgroundColor: colors.background,
})

const $topContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexShrink: 1,
  flexGrow: 0,
  flexBasis: "40%",
  justifyContent: "center",
  paddingHorizontal: spacing.lg,
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

const $bottomContainer: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexShrink: 1,
  flexGrow: 1,
  flexBasis: "10%",
  backgroundColor: colors.palette.neutral800,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  paddingHorizontal: spacing.xxl,
})

const $welcomeLogo: ThemedStyle<ImageStyle> = ({ spacing }) => ({
  height: 88,
  width: "100%",
  marginBottom: spacing.xxl,
})

const $buttonNumber: ThemedStyle<TextStyle> = ({ colors, spacing, typography }) => ({
  position: "absolute",
  top: spacing.xxs,
  left: spacing.xs,
  fontFamily: typography.code?.normal,
  backgroundColor: colors.palette.neutral900,
  color: colors.palette.neutral200,
  zIndex: 1,
})
