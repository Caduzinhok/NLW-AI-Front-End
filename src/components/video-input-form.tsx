import { FileVideo, Upload } from "lucide-react"
import { Separator } from "./ui/separator"
import { Label } from "./ui/label"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react"
import { getFFmpeg } from "@/lib/ffmpeg"
import {fetchFile} from '@ffmpeg/util'
import { api } from '@/lib/axios'

type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'

interface VideoInputFormProps{
  onVideoUploaded: (id: string) => void
}
const statusMessages = {
  converting: 'Convertendo...',
  generating: 'Transcrevendo...',
  uploading: 'Carregando...',
  success: 'Sucesso!'
}
export function VideoInputForm(props: VideoInputFormProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [status, setStatus] = useState<Status>('waiting')

    const promptInputRef = useRef<HTMLTextAreaElement>(null)


    function handleFileSelected(event: ChangeEvent<HTMLInputElement>){
        const { files } = event.currentTarget

        if(!files){
            return
        }

        const selectedFile = files[0]
        setVideoFile(selectedFile)
    }

    async function convertVideoToAudio(video: File){
      console.log('Convert Started.')
    
      const ffmpeg = await getFFmpeg()

      await ffmpeg?.writeFile('input.mp4', await fetchFile(video))

      // ffmpeg?.on('log', log => {
      //   console.log(log)
      // })

      ffmpeg?.on('progress', progress => {
        console.log('Convert Progress: '+ Math.round(progress.progress + 100))
      })

      await ffmpeg?.exec([
        '-i',
        'input.mp4',
        '-map',
        '0:a',
        '-b:a',
        '20k',
        '-acodec',
        'libmp3lame',
        'output.mp3'
      ])

      const data = await ffmpeg?.readFile('output.mp3')

      const audioFileBlob = new Blob([data as BlobPart], {type:'audio/mpeg'})

      const audioFile = new File([audioFileBlob], 'audio.mp3', {type: 'audio/mpeg'})

      console.log('Convert Finished.')

      return audioFile
    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
        event?.preventDefault()
        const prompt = promptInputRef.current?.value

        if(!videoFile){
          return
        }


        setStatus('converting')
        // converter o video em audio
        const audioFile = await convertVideoToAudio(videoFile)

        const data = new FormData()

        data.append('file', audioFile)

        setStatus('uploading')


        const response = await api.post('/videos', data)

        const videoId = response.data.video.id

        setStatus('generating')

        await api.post(`/videos/${videoId}/transcription`, {
          prompt,
        })

        setStatus('success')
        props.onVideoUploaded(videoId)
    }

    const previewURL = useMemo(() => {
        if(!videoFile){
            return null
        }

        return URL.createObjectURL(videoFile)
    }, [videoFile])
    return(
        <form onSubmit={handleUploadVideo} action="" className="space-y-6">
        <label
          className="relative border w-full flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/10"
          htmlFor="video">
          {previewURL ?  (
            <video src={previewURL} controls={false} className="pointer-events-none absolute inset-0" />
          ) : (
            <>
                <FileVideo className="w-4 h-4" />
                Selecione um video
            </>
          )}
        </label>

        <input type="file" id="video" accept="video/mp4" className="sr-only" onChange={handleFileSelected} />

        <Separator />

        <div className="space-y-2">
          <Label htmlFor='transcription_prompt'>
            Prompt de Transcrição
          </Label>

          <Textarea
            disabled={status !== 'waiting'}
            ref={promptInputRef}
            id="transcription_prompt"
            className="h-20 leading-relaxed resize-none"
            placeholder="Inclua palavras-chave mencionadas no video separada por vírgula (,)"
          />
        </div>

        <Button 
        data-success={status === "success"}
        type="submit" 
        className="w-full data-[success=true]:bg-emerald-400" 
        disabled={status !== 'waiting'}>
          {status === "waiting" ? (
            <>
              Carregar video
              <Upload className="w-4 h-4 ml-2" />
            </> 
          ) : statusMessages[status]}
        </Button>
      </form>
    )
}